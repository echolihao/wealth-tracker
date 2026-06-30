import {
  getSecuritiesAccounts,
  getPositions,
  updatePositionPrice,
  getTrades,
  createTrade,
  updateTrade,
  deleteTrade,
} from '../controllers/trades'

export default [
  {
    method: 'GET',
    url: '/api/trades/securities-accounts',
    handler: getSecuritiesAccounts,
  },
  {
    method: 'GET',
    url: '/api/assets/:assetType/positions',
    handler: getPositions,
  },
  {
    method: 'PUT',
    url: '/api/assets/:assetType/positions/:symbol',
    handler: updatePositionPrice,
  },
  {
    method: 'GET',
    url: '/api/assets/:assetType/trades',
    handler: getTrades,
  },
  {
    method: 'POST',
    url: '/api/assets/:assetType/trades',
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
]
