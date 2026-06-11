import { create, get, update, destroy } from '../controllers/goals'

export default [
  {
    method: 'POST',
    url: '/api/goals',
    handler: create,
  },
  {
    method: 'GET',
    url: '/api/goals',
    handler: get,
  },
  {
    method: 'PUT',
    url: '/api/goals',
    handler: update,
  },
  {
    method: 'DELETE',
    url: '/api/goals',
    handler: destroy,
  },
]
