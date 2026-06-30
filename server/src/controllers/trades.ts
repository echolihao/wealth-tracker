import { Op } from 'sequelize'
import { sequelize } from '../models'
import { Assets } from '../models/assets'
import { Position } from '../models/positions'
import { Trade } from '../models/trades'

export const getSecuritiesAccounts = async (_, reply) => {
  try {
    const data = await Assets.findAll({
      where: {
        type: { [Op.startsWith]: 'securities:' },
      },
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
  const { assetType } = request.params
  try {
    const data = await Position.findAll({
      where: { asset_type: assetType },
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
  const { assetType, symbol } = request.params
  const { current_price, amount } = request.body
  try {
    const result = await sequelize.transaction(async (t) => {
      const position = await Position.findOne({
        where: { asset_type: assetType, security_symbol: symbol },
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
        where: { asset_type: assetType, security_symbol: symbol },
        transaction: t,
      })
      const updated = await Position.findOne({
        where: { asset_type: assetType, security_symbol: symbol },
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
  const { assetType } = request.params
  const { page = 1, size = 10 } = request.query
  try {
    const offset = (page - 1) * size
    const { count, rows } = await Trade.findAndCountAll({
      where: { asset_type: assetType },
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
  const { assetType } = request.params
  const params = request.body

  if (!assetType || !assetType.startsWith('securities:')) {
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

  const trade_date = params.trade_date
  if (!trade_date) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Trade date is required.',
    })
  }

  try {
    const result = await sequelize.transaction(async (t) => {
      // 1. Create trade record
      const trade = await Trade.create(
        {
          asset_type: assetType,
          security_symbol: params.security_symbol,
          security_name: params.security_name,
          type: params.type,
          quantity,
          price,
          amount,
          trade_date,
          note: params.note || '',
          created: new Date(),
        },
        { transaction: t },
      )

      // 2. Update position
      const existing = await Position.findOne({
        where: {
          asset_type: assetType,
          security_symbol: params.security_symbol,
        },
        transaction: t,
      })

      if (params.type === 'BUY') {
        if (existing) {
          const oldQty = Number(existing.quantity)
          const oldCost = Number(existing.cost_price)
          const newQty = oldQty + quantity
          const newCost = (oldQty * oldCost + quantity * price) / newQty
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
          await Position.create(
            {
              asset_type: assetType,
              security_symbol: params.security_symbol,
              security_name: params.security_name,
              quantity,
              cost_price: price,
              current_price: price,
              amount: quantity * price,
              status: 'Open',
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
        const updateData: any = {
          quantity: newQty,
          updated: new Date(),
        }
        if (newQty === 0) {
          updateData.status = 'Closed'
          updateData.amount = 0
        } else {
          const currentPrice =
            existing.current_price !== null
              ? Number(existing.current_price)
              : Number(existing.cost_price)
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
      const newDate = params.trade_date || oldTrade.trade_date

      await applyTradeEffect(
        oldTrade.asset_type,
        newType,
        newSymbol,
        newName,
        newQty,
        newPrice,
        t,
      )

      await Trade.update(
        {
          type: newType,
          security_symbol: newSymbol,
          security_name: newName,
          quantity: newQty,
          price: newPrice,
          amount: newAmount,
          trade_date: newDate,
          note: params.note !== undefined ? params.note : oldTrade.note,
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
  const assetType = trade.asset_type
  const symbol = trade.security_symbol
  const qty = Number(trade.quantity)
  const price = Number(trade.price)

  const existing = await Position.findOne({
    where: { asset_type: assetType, security_symbol: symbol },
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
        const restoredCost =
          oldQty > 0 ? (oldQty * oldCost - qty * price) / newQty : 0
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
          amount: newQty * currentPrice,
          updated: new Date(),
        },
        { transaction: t },
      )
    } else {
      // Position was fully closed and deleted (shouldn't happen since we use Closed status)
      const currentPrice = price
      await Position.create(
        {
          asset_type: assetType,
          security_symbol: symbol,
          security_name: trade.security_name,
          quantity: qty,
          cost_price: price,
          current_price: price,
          amount: qty * currentPrice,
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
  assetType: string,
  type: string,
  symbol: string,
  name: string,
  quantity: number,
  price: number,
  t: any,
) {
  const existing = await Position.findOne({
    where: { asset_type: assetType, security_symbol: symbol },
    transaction: t,
  })

  if (type === 'BUY') {
    if (existing) {
      const oldQty = Number(existing.quantity)
      const oldCost = Number(existing.cost_price)
      const newQty = oldQty + quantity
      const newCost = (oldQty * oldCost + quantity * price) / newQty
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
      await Position.create(
        {
          asset_type: assetType,
          security_symbol: symbol,
          security_name: name,
          quantity,
          cost_price: price,
          current_price: price,
          amount: quantity * price,
          status: 'Open',
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
    const updateData: any = {
      quantity: newQty,
      updated: new Date(),
    }
    if (newQty === 0) {
      updateData.status = 'Closed'
      updateData.amount = 0
    } else {
      const currentPrice =
        existing.current_price !== null
          ? Number(existing.current_price)
          : Number(existing.cost_price)
      updateData.amount = newQty * currentPrice
    }
    await existing.update(updateData, { transaction: t })
  }
}
