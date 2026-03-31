import { EntitySchema } from "typeorm";

export default new EntitySchema({
  name: "CeilingFan",
  tableName: "ceiling_fan",
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: true,
    },
    fanname: {
      type: String,
      length: 45,
    },
    gate_id: {
      type: Number,
      nullable: true,
    },
    name: {
      type: String,
      length: 45,
      nullable: true,
    },
    model_type: {
      type: Number,
      nullable: true,
    },
    model_type_name: {
      type: String,
      length: 100,
      nullable: true,
    },
    firmware: {
      type: String,
      length: 100,
      nullable: true,
    },
    motor_state: {
      type: Number,
      nullable: true,
    },
    fan_status: {
      type: String,
      length: 20,
      nullable: true,
    },
    speed_level: {
      type: Number,
      default: 0,
    },
    rpm: {
      type: String,
      length: 20,
      nullable: true,
    },
    rotation_direction: {
      type: Number,
      nullable: true,
    },
    created_at: {
      type: "datetime",
      nullable: true,
    },
    updated_at: {
      type: "datetime",
      nullable: true,
    },
    deleted_at: {
      type: "datetime",
      nullable: true,
    },
    deleted_flag: {
      type: Number,
      default: 0,
    }
  },
}); 