import { sequelize } from '../models'
import { Assets } from './../models/assets'
import { Record } from './../models/records'
import { Position } from './../models/positions'
import { Trade } from './../models/trades'

export const create = async (request, reply) => {
  const params = request?.body
  try {
    const options = {
      type: params.type,
      alias: params.alias || params.type,
      amount: params.amount,
      currency: params.currency,
      note: params.note,
      datetime: params.datetime,
      risk: params.risk,
      liquidity: params.liquidity,
      tags: params.tags || '',
      updated: new Date(),
    }
    const assets = await Assets.create(options)
    await Record.create(assets.dataValues)
    return reply.send(assets)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

export const get = async (_, reply) => {
  try {
    const data = await Assets.findAll()
    return reply.send(data)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

export const update = async (request, reply) => {
  const params = request?.body
  const now = new Date()
  try {
    const options = {
      type: params.type,
      alias: params.alias,
      amount: params.amount,
      currency: params.currency,
      note: params.note,
      datetime: params.datetime,
      created: params.created,
      risk: params.risk,
      liquidity: params.liquidity,
      tags: params.tags || '',
      updated: now,
    }
    const data = await Assets.update(options, {
      where: { type: params.type },
    })
    await Record.create({
      ...options,
      created: now,
    })
    return reply.send(data)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

export const destroy = async (request, reply) => {
  const { type = '' } = request?.body
  try {
    await sequelize.transaction(async (t) => {
      await Trade.destroy({ where: { asset_type: type }, transaction: t })
      await Position.destroy({ where: { asset_type: type }, transaction: t })
      await Assets.destroy({ where: { type }, transaction: t })
      await Record.destroy({ where: { type }, transaction: t })
    })
    return reply.send({ result: true })
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}
