import { EntitySchema } from "typeorm";

export default new EntitySchema({
  name: "VentilFanGroupMapping",
  tableName: "ventil_fan_group_mapping",
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: true,
    },
    fan_id: {
      type: Number,
    },
    group_id: {
      type: Number,
    },
    is_deleted: {
      type: Number,
      default: 0,
    },
    house_deleted_int: {
      type: Number,
      default: 0,
    },
  },
}); 