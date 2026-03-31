import { EntitySchema } from "typeorm";

export default new EntitySchema({
  name: "VentilGroup",
  tableName: "ventil_group",
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
      length: 200,
    },
    order: {
      type: Number,
    },
    created_at: {
      type: "datetime",
      nullable: true,
    },
  },
}); 