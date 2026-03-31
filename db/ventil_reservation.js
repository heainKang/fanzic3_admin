import { EntitySchema } from "typeorm";

export default new EntitySchema({
  name: "VentilReservation",
  tableName: "ventil_reservation",
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: true,
    },
    fan_id: {
      type: Number,
    },
    reservation_time: {
      type: "datetime",
    },
    created_at: {
      type: "datetime",
      nullable: true,
    },
    hours: {
      type: Number,
    },
    minutes: {
      type: Number,
    },
    executed: {
      type: Number,
    },
  },
}); 