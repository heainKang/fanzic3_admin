import { EntitySchema } from "typeorm";

export default new EntitySchema({
  name: "CeilingHouse",
  tableName: "ceiling_house",
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: true,
    },
    name: {
      type: String,
      length: 100,
    },
    user_id: {
      type: Number,
    },
    order: {
      type: Number,
    },
    deleted_flag: {
      type: Number,
      default: 0,
    },
  },
}); 