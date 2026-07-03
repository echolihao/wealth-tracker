import { DataTypes, Model } from 'sequelize'
import { sequelize } from './index'

export class Trade extends Model {
  declare id: number
  declare asset_id: number
  declare position_id: number | null
  declare security_symbol: string
  declare security_name: string
  declare type: string
  declare quantity: number
  declare price: number
  declare amount: number
  declare trade_date: string
  declare note: string
  declare fee: number
  declare realized_pnl: number | null
  declare created: Date
}

Trade.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    asset_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    position_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    security_symbol: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    security_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    trade_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '',
    },
    fee: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    realized_pnl: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
    },
    created: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Trade',
    tableName: 'trades',
    timestamps: false,
  },
)
