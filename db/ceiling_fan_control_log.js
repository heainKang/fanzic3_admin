import { EntitySchema } from "typeorm";

export default new EntitySchema({
  name: "CeilingFanControlLog",
  tableName: "ceiling_fan_control_log",
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: true,
    },
    fan_id: {
      type: Number,
    },
    command: {
      type: String,
      length: 100,
    },
    time_stamp: {
      type: "datetime",
      nullable: true,
    },
  },
}); 