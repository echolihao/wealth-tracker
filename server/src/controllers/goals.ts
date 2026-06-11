import { Goal } from '../models/goals'

export const create = async (request, reply) => {
  const params = request?.body
  try {
    if (!params?.name || !(Number(params?.amount) > 0)) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'A goal requires a name and a positive target amount.',
      })
    }
    const goal = await Goal.create({
      name: params.name,
      amount: params.amount,
      currency: params.currency || 'CNY',
      deadline: params.deadline || null,
      created: new Date(),
      updated: new Date(),
    })
    return reply.send(goal)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

export const get = async (_, reply) => {
  try {
    const data = await Goal.findAll({ order: [['created', 'ASC']] })
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
  try {
    const options: any = { updated: new Date() }
    if (params.name !== undefined) options.name = params.name
    if (params.amount !== undefined) options.amount = params.amount
    if (params.currency !== undefined) options.currency = params.currency
    if (params.deadline !== undefined) options.deadline = params.deadline || null
    if (params.achievedAt !== undefined) options.achievedAt = params.achievedAt || null

    const data = await Goal.update(options, {
      where: { id: params.id },
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
  const { id } = request?.body
  try {
    await Goal.destroy({ where: { id } })
    return reply.send({ result: true })
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}
