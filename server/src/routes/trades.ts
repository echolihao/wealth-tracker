import {
  getSecuritiesAccounts,
  getPositions,
  updatePositionPrice,
  getTrades,
  createTrade,
  updateTrade,
  deleteTrade,
  importTrades,
} from '../controllers/trades'

export default [
  {
    method: 'GET',
    url: '/api/trades/securities-accounts',
    handler: getSecuritiesAccounts,
  },
  {
    method: 'GET',
    url: '/api/assets/:id/positions',
    handler: getPositions,
  },
  {
    method: 'PUT',
    url: '/api/assets/:id/positions/:symbol',
    handler: updatePositionPrice,
  },
  {
    method: 'GET',
    url: '/api/assets/:id/trades',
    handler: getTrades,
  },
  {
    method: 'POST',
    url: '/api/assets/:id/trades',
    handler: createTrade,
  },
  {
    method: 'PUT',
    url: '/api/trades/:id',
    handler: updateTrade,
  },
  {
    method: 'DELETE',
    url: '/api/trades/:id',
    handler: deleteTrade,
  },
  {
    method: 'POST',
    url: '/api/assets/:id/trades/import',
    handler: importTrades,
  },
]
