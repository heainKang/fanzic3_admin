import { EntitySchema } from "typeorm";

export default new EntitySchema({
  name: "CeilingFanGroupMapping",
  tableName: "ceiling_fan_group_mapping",
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
      nullable: true,
    },
    fan_deleted: {
      type: Number,
      default: 0,
    },
    house_deleted: {
      type: Number,
      default: 0,
    },
  },
}); 