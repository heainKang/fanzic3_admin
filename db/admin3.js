// src/entity/User.js
import { EntitySchema } from "typeorm";


export default new EntitySchema({
  name: "Admin3",
  tableName: "admin",
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: true
    },
    admin_id: {
        type: String
    },
    password: {
        type: String
    },
    name: {
        type: String
    },
    email: {
        type: String
    },
    address: {
        type: String
    },
    contact: {
        type: String
    },
    birthday: {
        type: Date
    },
    phoneNumber: {
        type: String
    }
}
});