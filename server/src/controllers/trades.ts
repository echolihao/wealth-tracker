import { Op } from 'sequelize'
import { parse } from 'csv-parse/sync'
import { sequelize } from '../models'
import { Assets } from '../models/assets'
import { Position } from '../models/positions'
import { Trade } from '../models/trades'

export const getSecuritiesAccounts = async (_, reply) => {
  try {
    const data = await Assets.findAll({
      where: { type: 'INVESTMENT' },
    })
    return reply.send(data)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

export const getPositions = async (request, reply) => {
  const { id } = request.params
  try {
    const data = await Position.findAll({
      where: { asset_id: id },
      order: [['created', 'ASC']],
    })
    return reply.send(data)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

export const updatePositionPrice = async (request, reply) => {
  const { id, symbol } = request.params
  const { current_price, amount } = request.body
  try {
    const result = await sequelize.transaction(async (t) => {
      const position = await Position.findOne({
        where: { asset_id: id, security_symbol: symbol, status: 'Open' },
        transaction: t,
      })
      if (!position) {
        throw new Error('Position not found.')
      }
      const updateData: any = { updated: new Date() }
      if (current_price !== undefined) {
        updateData.current_price = current_price
      }
      if (amount !== undefined) {
        updateData.amount = amount
      }
      await Position.update(updateData, {
        where: { id: position.id },
        transaction: t,
      })
      const updated = await Position.findOne({
        where: { id: position.id },
        transaction: t,
      })
      return updated
    })
    return reply.send(result)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

export const getTrades = async (request, reply) => {
  const { id } = request.params
  const { page = 1, size = 10, startDate, endDate, type, symbol } = request.query
  try {
    const offset = (page - 1) * size
    const whereClause: any = { asset_id: id }

    if (startDate) {
      whereClause.trade_date = { ...whereClause.trade_date, [Op.gte]: startDate }
    }
    if (endDate) {
      whereClause.trade_date = { ...whereClause.trade_date, [Op.lte]: endDate }
    }
    if (type) {
      whereClause.type = type
    }
    if (symbol) {
      whereClause.security_symbol = { [Op.like]: `%${symbol}%` }
    }

    const { count, rows } = await Trade.findAndCountAll({
      where: whereClause,
      order: [['trade_date', 'DESC'], ['created', 'DESC']],
      offset,
      limit: size,
    })
    return reply.send({
      total: count,
      page: Number(page),
      size: Number(size),
      data: rows,
    })
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

export const createTrade = async (request, reply) => {
  const { id } = request.params
  const params = request.body

  if (!id) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Asset id is required.',
    })
  }
  const account = await Assets.findByPk(id)
  if (!account || account.type !== 'INVESTMENT') {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Invalid securities account type.',
    })
  }

  if (!params.type || !['BUY', 'SELL'].includes(params.type)) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Trade type must be BUY or SELL.',
    })
  }

  if (!params.security_symbol || !params.security_name) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Security symbol and name are required.',
    })
  }

  const quantity = Number(params.quantity)
  const price = Number(params.price)
  if (!quantity || quantity <= 0) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Quantity must be a positive number.',
    })
  }
  if (!price || price <= 0) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Price must be a positive number.',
    })
  }

  const amount = Number(params.amount)
  if (Math.abs(amount - quantity * price) > 0.01) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Amount must equal quantity × price.',
    })
  }

  const fee = Math.max(0, Number(params.fee) || 0)

  const trade_date = params.trade_date
  if (!trade_date) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Trade date is required.',
    })
  }

  try {
    const result = await sequelize.transaction(async (t) => {
      // 0. Look up existing position for realized_pnl calculation
      const existing = await Position.findOne({
        where: {
          asset_id: id,
          security_symbol: params.security_symbol,
          status: 'Open',
        },
        transaction: t,
      })

      const costPrice = existing ? Number(existing.cost_price) : price

      // 1. Create trade record
      const trade = await Trade.create(
        {
          asset_id: id,
          security_symbol: params.security_symbol,
          security_name: params.security_name,
          type: params.type,
          quantity,
          price,
          amount,
          fee,
          trade_date,
          note: params.note || '',
          realized_pnl:
            params.type === 'SELL' && existing
              ? (price - costPrice) * quantity - fee
              : null,
          created: new Date(),
        },
        { transaction: t },
      )

      // 2. Update position

      if (params.type === 'BUY') {
        if (existing && Number(existing.quantity) > 0) {
          // Existing open position: weighted average update
          const oldQty = Number(existing.quantity)
          const oldCost = Number(existing.cost_price)
          const newQty = oldQty + quantity
          const newCost = (oldQty * oldCost + quantity * price + fee) / newQty
          const currentPrice =
            existing.current_price !== null
              ? Number(existing.current_price)
              : price
          await existing.update(
            {
              quantity: newQty,
              cost_price: newCost,
              amount: newQty * currentPrice,
              status: 'Open',
              updated: new Date(),
            },
            { transaction: t },
          )
        } else {
          // No open position exists — create a new one
          await Position.create(
            {
              asset_id: id,
              security_symbol: params.security_symbol,
              security_name: params.security_name,
              quantity,
              cost_price: (quantity * price + fee) / quantity,
              current_price: price,
              amount: quantity * price,
              realized_pnl: 0,
              status: 'Open',
              open_date: trade_date,
              created: new Date(),
              updated: new Date(),
            },
            { transaction: t },
          )
        }
      } else {
        // SELL
        if (!existing) {
          throw new Error('Position not found for sell.')
        }
        const oldQty = Number(existing.quantity)
        if (quantity > oldQty) {
          throw new Error(
            `Insufficient quantity. Available: ${oldQty}, attempting to sell: ${quantity}.`,
          )
        }
        const newQty = oldQty - quantity
        const costPrice = Number(existing.cost_price)
        const realizedPnl = (price - costPrice) * quantity - fee
        const updateData: any = {
          quantity: newQty,
          realized_pnl: Number(existing.realized_pnl ?? 0) + realizedPnl,
          updated: new Date(),
        }
        if (newQty === 0) {
          updateData.status = 'Closed'
          updateData.close_date = trade_date
          updateData.amount = 0
        } else {
          const currentPrice =
            existing.current_price !== null
              ? Number(existing.current_price)
              : costPrice
          updateData.amount = newQty * currentPrice
        }
        await existing.update(updateData, { transaction: t })
      }

      return trade
    })

    return reply.send(result)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

export const updateTrade = async (request, reply) => {
  const { id } = request.params
  const params = request.body
  try {
    let updated

    await sequelize.transaction(async (t) => {
      const oldTrade = await Trade.findByPk(id, { transaction: t })
      if (!oldTrade) {
        throw new Error('Trade not found.')
      }

      // Reverse old trade
      await reverseTradeEffect(oldTrade, t)

      // Apply new trade
      const newType = params.type || oldTrade.type
      const newSymbol = params.security_symbol || oldTrade.security_symbol
      const newName = params.security_name || oldTrade.security_name
      const newQty = Number(params.quantity ?? oldTrade.quantity)
      const newPrice = Number(params.price ?? oldTrade.price)
      const newAmount = Number(params.amount ?? oldTrade.amount)
      const newFee = params.fee !== undefined ? Math.max(0, Number(params.fee) || 0) : Number(oldTrade.fee ?? 0)
      const newDate = params.trade_date || oldTrade.trade_date

      // Query position state before applying new trade (for realized_pnl calculation)
      const posBefore = await Position.findOne({
        where: { asset_id: oldTrade.asset_id, security_symbol: newSymbol, status: 'Open' },
        transaction: t,
      })
      const costPriceBefore = posBefore ? Number(posBefore.cost_price) : newPrice

      await applyTradeEffect(
        oldTrade.asset_id,
        newType,
        newSymbol,
        newName,
        newQty,
        newPrice,
        t,
        newDate,
        undefined,
        newFee,
      )

      await Trade.update(
        {
          type: newType,
          security_symbol: newSymbol,
          security_name: newName,
          quantity: newQty,
          price: newPrice,
          amount: newAmount,
          fee: newFee,
          trade_date: newDate,
          note: params.note !== undefined ? params.note : oldTrade.note,
          realized_pnl:
            newType === 'SELL' && posBefore
              ? (newPrice - costPriceBefore) * newQty - newFee
              : null,
        },
        { where: { id }, transaction: t },
      )

      updated = await Trade.findByPk(id, { transaction: t })
    })

    return reply.send(updated)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

export const deleteTrade = async (request, reply) => {
  const { id } = request.params
  try {
    await sequelize.transaction(async (t) => {
      const trade = await Trade.findByPk(id, { transaction: t })
      if (!trade) {
        throw new Error('Trade not found.')
      }
      await reverseTradeEffect(trade, t)
      await Trade.destroy({ where: { id }, transaction: t })
    })

    return reply.send({ result: true })
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

// Helper: reverse a trade's effect on positions
async function reverseTradeEffect(trade: any, t: any) {
  const assetId = trade.asset_id
  const symbol = trade.security_symbol
  const qty = Number(trade.quantity)
  const price = Number(trade.price)

  const existing = await Position.findOne({
    where: { asset_id: assetId, security_symbol: symbol },
    order: [['id', 'DESC']],
    transaction: t,
  })

  if (trade.type === 'BUY') {
    // Reverse buy: decrease quantity
    if (existing) {
      const oldQty = Number(existing.quantity)
      const newQty = oldQty - qty
      if (newQty < 0) {
        throw new Error(
          'Cannot reverse this trade: position quantity would go negative.',
        )
      }
      const updateData: any = {
        quantity: newQty,
        updated: new Date(),
      }
      if (newQty === 0) {
        updateData.status = 'Closed'
        updateData.amount = 0
      } else {
        // Restore cost price to before this buy (reverse weighted avg)
        const oldCost = Number(existing.cost_price)
        const tradeFee = Number(trade.fee ?? 0)
        const restoredCost =
          oldQty > 0 ? (oldQty * oldCost - qty * price - tradeFee) / newQty : 0
        updateData.cost_price = restoredCost
        const currentPrice =
          existing.current_price !== null
            ? Number(existing.current_price)
            : price
        updateData.amount = newQty * currentPrice
      }
      await existing.update(updateData, { transaction: t })
    }
  } else {
    // Reverse sell: increase quantity
    const tradeRealizedPnl = Number(trade.realized_pnl ?? 0)
    if (existing) {
      const oldQty = Number(existing.quantity)
      const newQty = oldQty + qty
      const currentPrice =
        existing.current_price !== null
          ? Number(existing.current_price)
          : Number(existing.cost_price)
      await existing.update(
        {
          quantity: newQty,
          status: 'Open',
          close_date: null,
          amount: newQty * currentPrice,
          realized_pnl: Number(existing.realized_pnl ?? 0) - tradeRealizedPnl,
          updated: new Date(),
        },
        { transaction: t },
      )
    } else {
      // Position was fully closed and deleted (shouldn't happen since we use Closed status)
      const currentPrice = price
      await Position.create(
        {
          asset_id: assetId,
          security_symbol: symbol,
          security_name: trade.security_name,
          quantity: qty,
          cost_price: price,
          current_price: price,
          amount: qty * currentPrice,
          realized_pnl: -tradeRealizedPnl,
          status: 'Open',
          created: new Date(),
          updated: new Date(),
        },
        { transaction: t },
      )
    }
  }
}

// Helper: apply a trade's effect on positions
async function applyTradeEffect(
  assetId: number,
  type: string,
  symbol: string,
  name: string,
  quantity: number,
  price: number,
  t: any,
  tradeDate?: string,
  existingPosition?: any,
  fee: number = 0,
) {
  const existing = existingPosition || await Position.findOne({
    where: { asset_id: assetId, security_symbol: symbol, status: 'Open' },
    transaction: t,
  })

  if (type === 'BUY') {
    if (existing && Number(existing.quantity) > 0) {
      // Existing open position: weighted average update
      const oldQty = Number(existing.quantity)
      const oldCost = Number(existing.cost_price)
      const newQty = oldQty + quantity
      const newCost = (oldQty * oldCost + quantity * price + fee) / newQty
      const currentPrice =
        existing.current_price !== null
          ? Number(existing.current_price)
          : price
      await existing.update(
        {
          quantity: newQty,
          cost_price: newCost,
          amount: newQty * currentPrice,
          status: 'Open',
          updated: new Date(),
        },
        { transaction: t },
      )
    } else {
      // No open position exists — create a new one
      await Position.create(
        {
          asset_id: assetId,
          security_symbol: symbol,
          security_name: name,
          quantity,
          cost_price: (quantity * price + fee) / quantity,
          current_price: price,
          amount: quantity * price,
          realized_pnl: 0,
          status: 'Open',
          open_date: tradeDate || null,
          created: new Date(),
          updated: new Date(),
        },
        { transaction: t },
      )
    }
  } else {
    // SELL
    if (!existing) {
      throw new Error('Position not found for sell.')
    }
    const oldQty = Number(existing.quantity)
    if (quantity > oldQty) {
      throw new Error(
        `Insufficient quantity. Available: ${oldQty}, attempting to sell: ${quantity}.`,
      )
    }
    const newQty = oldQty - quantity
    const costPrice = Number(existing.cost_price)
    const realizedPnl = (price - costPrice) * quantity - fee
    const updateData: any = {
      quantity: newQty,
      realized_pnl: Number(existing.realized_pnl ?? 0) + realizedPnl,
      updated: new Date(),
    }
    if (newQty === 0) {
      updateData.status = 'Closed'
      updateData.close_date = tradeDate || null
      updateData.amount = 0
    } else {
      const currentPrice =
        existing.current_price !== null
          ? Number(existing.current_price)
          : costPrice
      updateData.amount = newQty * currentPrice
    }
    await existing.update(updateData, { transaction: t })
  }
}

export const importTrades = async (request, reply) => {
  const { id } = request.params

  if (!id) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Asset id is required.',
    })
  }

  // Validate account is securities account
  const account = await Assets.findByPk(id)
  if (!account || account.type !== 'INVESTMENT') {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Invalid securities account type.',
    })
  }

  try {
    // 1. Read uploaded file
    const data = await request.file()
    if (!data) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'No file uploaded.',
      })
    }

    const buffer = await data.toBuffer()
    const content = buffer.toString('utf-8').trim()

    if (!content) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'File is empty.',
      })
    }

    // 2. Parse CSV
    let records: any[]
    try {
      records = parse(content, {
        columns: [
          'trade_date',
          'type',
          'security_symbol',
          'security_name',
          'quantity',
          'price',
          'amount',
          'fee',
          'note',
        ],
        from: 2, // skip header row
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      })
    } catch (parseErr: any) {
      return reply.code(400).send({
        success: false,
        imported: 0,
        errors: [{ row: 0, field: 'CSV', message: `CSV 解析失败: ${parseErr.message}` }],
        details: 'CSV 文件格式错误，请检查后重试。',
      })
    }

    if (records.length === 0) {
      return reply.code(400).send({
        success: false,
        imported: 0,
        errors: [],
        details: 'CSV 文件中没有数据行。',
      })
    }

    if (records.length > 1000) {
      return reply.code(400).send({
        success: false,
        imported: 0,
        errors: [],
        details: `CSV 文件包含 ${records.length} 行，超过 1000 行上限，请分批导入。`,
      })
    }

    // 3. Validate all rows
    const errors: Array<{ row: number; field: string; message: string }> = []
    const warnings: Array<{ row: number; field: string; message: string }> = []
    const validated: Array<{
      trade_date: string
      type: string
      security_symbol: string
      security_name: string
      quantity: number
      price: number
      amount: number
      fee: number
      note: string
    }> = []

    records.forEach((row: any, idx: number) => {
      const rowNum = idx + 2 // CSV row number (1-indexed, +1 for header)

      // trade_date
      if (!row.trade_date || !/^\d{4}-\d{2}-\d{2}$/.test(row.trade_date)) {
        errors.push({ row: rowNum, field: '交易日期', message: '日期格式必须为 YYYY-MM-DD' })
        return
      }

      // type
      const tradeType = row.type?.toUpperCase()
      if (!tradeType || !['BUY', 'SELL'].includes(tradeType)) {
        errors.push({ row: rowNum, field: '操作类型', message: '操作类型必须为 BUY 或 SELL' })
        return
      }

      // symbol
      if (!row.security_symbol || !row.security_symbol.trim()) {
        errors.push({ row: rowNum, field: '证券代码', message: '证券代码不能为空' })
        return
      }

      // name
      if (!row.security_name || !row.security_name.trim()) {
        errors.push({ row: rowNum, field: '证券名称', message: '证券名称不能为空' })
        return
      }

      // quantity
      const qty = Number(row.quantity)
      if (!qty || qty <= 0) {
        errors.push({ row: rowNum, field: '数量', message: '数量必须为正数' })
        return
      }

      // price
      const p = Number(row.price)
      if (!p || p <= 0) {
        errors.push({ row: rowNum, field: '价格', message: '价格必须为正数' })
        return
      }

      // amount (optional — use qty * price if not provided or empty)
      let amt: number
      if (row.amount === undefined || row.amount === null || row.amount === '') {
        amt = qty * p
      } else {
        amt = Number(row.amount)
        if (Math.abs(amt - qty * p) > 0.01) {
          warnings.push({ row: rowNum, field: '金额', message: '金额不等于数量 × 价格，已保留文件中填写的金额' })
        }
      }

      // fee (optional — default 0)
      let fee = 0
      if (row.fee !== undefined && row.fee !== null && row.fee !== '') {
        fee = Number(row.fee)
        if (fee < 0) {
          errors.push({ row: rowNum, field: '费用', message: '费用不能为负数' })
          return
        }
      }

      validated.push({
        trade_date: row.trade_date,
        type: tradeType,
        security_symbol: row.security_symbol.trim(),
        security_name: row.security_name.trim(),
        quantity: qty,
        price: p,
        amount: amt,
        fee,
        note: row.note?.trim() || '',
      })
    })

    if (errors.length > 0) {
      return reply.code(400).send({
        success: false,
        imported: 0,
        errors,
        warnings,
        details: `导入失败：共 ${errors.length} 行有错误。`,
      })
    }

    // 4. Sort by trade_date ascending
    validated.sort(
      (a, b) => a.trade_date.localeCompare(b.trade_date),
    )

    // 5. Execute in transaction
    await sequelize.transaction(async (t) => {
      for (const v of validated) {
        // Look up position BEFORE applyTradeEffect for correct cost_price
        const posBefore = await Position.findOne({
          where: { asset_id: id, security_symbol: v.security_symbol, status: 'Open' },
          transaction: t,
        })
        const costPrice = posBefore ? Number(posBefore.cost_price) : v.price

        await applyTradeEffect(
          id,
          v.type,
          v.security_symbol,
          v.security_name,
          v.quantity,
          v.price,
          t,
          v.trade_date,
          posBefore,
          v.fee,
        )

        await Trade.create(
          {
            asset_id: id,
            security_symbol: v.security_symbol,
            security_name: v.security_name,
            type: v.type,
            quantity: v.quantity,
            price: v.price,
            amount: v.amount,
            fee: v.fee,
            trade_date: v.trade_date,
            note: v.note,
            realized_pnl:
              v.type === 'SELL' && posBefore
                ? (v.price - costPrice) * v.quantity - v.fee
                : null,
            created: new Date(),
          },
          { transaction: t },
        )
      }
    })

    return reply.send({
      success: true,
      imported: validated.length,
      errors: [],
      warnings,
      details: `成功导入 ${validated.length} 条交易记录（共 ${validated.length} 条）。`,
    })
  } catch (error: any) {
    return reply.code(400).send({
      success: false,
      imported: 0,
      errors: [{ row: 0, field: '系统', message: error.message }],
      details: `导入失败：${error.message}`,
    })
  }
}
