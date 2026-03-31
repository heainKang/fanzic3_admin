import { EntitySchema } from "typeorm";

export default new EntitySchema({
  name: "CeilingGroup",
  tableName: "ceiling_group",
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: true,
    },
    name: {
      type: String,
      length: 45,
      nullable: true,
    },
    house_id: {
      type: Number,
      nullable: true,
    },
    motor_state: {
      type: Number,
      nullable: true,
    },
    speed_level: {
      type: Number,
      nullable: true,
    },
    order: {
      type: Number,
      nullable: true,
    },
    created_at: {
      type: "datetime",
      nullable: true,
    },
  },
}); 