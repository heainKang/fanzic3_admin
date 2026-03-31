import { EntitySchema } from "typeorm";

export default new EntitySchema({
  name: "CeilingModelType",
  tableName: "ceiling_model_type",
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
    SPID: {
      type: String,
      length: 45,
    },
    SPDL: {
      type: String,
      length: 45,
    },
    low_speed: {
      type: Number,
    },
    middle_speed: {
      type: Number,
    },
    high_speed: {
      type: Number,
    },
    turbo_speed: {
      type: Number,
    },
    created_at: {
      type: "datetime",
      nullable: true,
    },
  },
}); 