import { DataTypes, Model } from 'sequelize'
import { sequelize } from './index'

export class Position extends Model {}

Position.init(
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
    quantity: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    cost_price: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: false,
      defaultValue: 0,
    },
    current_price: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Open',
    },
    created: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    updated: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Position',
    tableName: 'positions',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['asset_type', 'security_symbol'],
      },
    ],
  },
)
