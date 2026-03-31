import { EntitySchema } from "typeorm";

export default new EntitySchema({
  name: "VentilSetting",
  tableName: "ventil_setting",
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: true,
    },
    fcmapping: {
      type: "longtext",
    },
    group: {
      type: "longtext",
    },
    fan: {
      type: "longtext",
    },
    user_id: {
      type: Number,
    },
    created_at: {
      type: "datetime",
      nullable: true,
    },
    updated_at: {
      type: "datetime",
      nullable: true,
    },
  },
}); 