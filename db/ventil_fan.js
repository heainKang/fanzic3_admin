import { EntitySchema } from "typeorm";

export default new EntitySchema({
  name: "VentilFan",
  tableName: "ventil_fan",
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: true,
    },
    name: {
      type: String,
      length: 45,
    },
    ip_adr: {
      type: String,
      length: 200,
    },
    mac_adr: {
      type: String,
      length: 200,
    },
    wifi_adr: {
      type: String,
      length: 200,
    },
    fan_ssid: {
      type: String,
      length: 200,
    },
    user_id: {
      type: String,
      length: 30,
    },
    firmware: {
      type: String,
      length: 100,
    },
    model_state: {
      type: Number,
    },
    model_state_int: {
      type: Number,
    },
    rotation_state: {
      type: Number,
    },
    speed_level: {
      type: Number,
    },
    order: {
      type: Number,
    },
    serial_number: {
      type: String,
      length: 100,
    },
    created_at: {
      type: "datetime",
      nullable: true,
    },
    updated_at: {
      type: "datetime",
      nullable: true,
    },
    lastUpdated: {
      type: "timestamp",
      nullable: true,
    },
    deleted_flag: {
      type: Number,
      default: 0,
    },
  },
}); 