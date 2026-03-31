import { EntitySchema } from "typeorm";

export default new EntitySchema({
  name: "CeilingGate",
  tableName: "ceiling_gate",
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: true,
    },
    house_id: {
      type: Number,
    },
    name: {
      type: String,
      length: 45,
      nullable: true,
    },
    SSID: {
      type: String,
      length: 100,
      nullable: true,
    },
    wifi_name: {
      type: String,
      length: 45,
      nullable: true,
    },
    ip_adr: {
      type: String,
      length: 45,
      nullable: true,
    },
    serial_number: {
      type: String,
      length: 45,
      nullable: true,
    },
    mac_adr: {
      type: String,
      length: 45,
      nullable: true,
    },
    firmware: {
      type: String,
      length: 45,
      nullable: true,
    },
    model: {
      type: String,
      length: 45,
      nullable: true,
    },
    fan_count: {
      type: Number,
      nullable: true,
    },
    updated_at: {
      type: "datetime",
      nullable: true,
    },
    created_at: {
      type: "datetime",
    },
    deleted_at: {
      type: "datetime",
      nullable: true,
    },
    deleted_flag: {
      type: Number,
      default: 0,
    },
  },
}); 