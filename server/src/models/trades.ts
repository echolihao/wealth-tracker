import { DataTypes, Model } from 'sequelize'
import { sequelize } from './index'

export class Trade extends Model {}

Trade.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    asset_type: {
      type: DataTypes.STRING,
      allowNull: false,
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
