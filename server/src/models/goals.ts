import { DataTypes, Model } from 'sequelize'
import { sequelize } from './index'

export class Goal extends Model {}

Goal.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'CNY',
    },
    deadline: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    achievedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created: {
      type: DataTypes.DATE,
      allowNull: false,
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
    modelName: 'Goal',
    tableName: 'goals',
    timestamps: false,
  },
)
