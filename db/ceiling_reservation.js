import { EntitySchema } from "typeorm";

export default new EntitySchema({
  name: "CeilingReservation",
  tableName: "ceiling_reservation",
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: true,
    },
    house_id: {
      type: Number,
    },
    group_id: {
      type: Number,
    },
    days: {
      type: "json",
    },
    time: {
      type: String,
      length: 10,
    },
    isPlaying: {
      type: String,
      length: 20,
    },
    speed_level: {
      type: Number,
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