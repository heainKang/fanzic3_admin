// src/entity/EnergyStatus.js
import { EntitySchema } from "typeorm";

export const EnergyStatus = new EntitySchema({
  name: "EnergyStatus",
  tableName: "energy_status",
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: true
    },
    fan_type: {
      type: "enum",
      enum: ["ceiling", "ventil"],
      default: "ceiling"
    },
    fan_id: {
      type: Number
    },
    user_id: {
      type: Number
    },
    house_id: {
      type: Number
    },
    group_id: {
      type: Number
    },
    gate_id: {
      type: Number,
      nullable: true
    },
    date: {
      type: Date
    },
    runtime_seconds: {
      type: Number,
      default: 0
    },
    wattage_kwh: {
      type: "decimal",
      precision: 10,
      scale: 5,
      default: 0
    },
    cost_won: {
      type: "decimal",
      precision: 10,
      scale: 2,
      default: 0
    },
    standard_rate: {
      type: "decimal",
      precision: 10,
      scale: 2
    },
    created_at: {
      type: "timestamp",
      createDate: true
    },
    updated_at: {
      type: "timestamp",
      updateDate: true
    }
  },
  indices: [
    {
      name: "idx_fan_type_id",
      columns: ["fan_type", "fan_id"]
    },
    {
      name: "idx_user_date",
      columns: ["user_id", "date"]
    },
    {
      name: "idx_house_date",
      columns: ["house_id", "date"]
    },
    {
      name: "idx_group_date",
      columns: ["group_id", "date"]
    },
    {
      name: "idx_date",
      columns: ["date"]
    },
    {
      name: "unique_fan_date",
      columns: ["fan_type", "fan_id", "date"],
      unique: true
    }
  ]
}); 