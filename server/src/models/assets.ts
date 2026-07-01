import { DataTypes, Model } from 'sequelize'
import { sequelize } from './index'

export class Assets extends Model {}

Assets.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['CASH', 'INVESTMENT']],
      },
    },
    alias: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '',
    },
    risk: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'LOW',
    },
    liquidity: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'GOOD',
    },
    tags: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '',
    },
    currency: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    datetime: {
      type: DataTypes.DATEONLY,
      allowNull: false,
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
    modelName: 'Assets',
    tableName: 'assets',
    timestamps: false,
  },
)
