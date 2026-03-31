// src/data-source3.js
import { DataSource } from "typeorm";
import dotenv from "dotenv";
dotenv.config({ path: ".env.fanzic" });

export const AppDataSource3 = new DataSource({
    type: "mysql",
    host: process.env.DB3_HOST,
    port: process.env.DB3_PORT,
    username: process.env.DB3_USERNAME,
    password: process.env.DB3_PASSWORD,
    database: process.env.DB3_DATABASE,
    entities: [
      "./db/user3.js",
      "./db/admin3.js",
      "./db/ventil_fan_control_log.js",
      "./db/ventil_fan.js",
      "./db/ventil_fan_group.js",
      "./db/ventil_fan_group_mapping.js",
      "./db/ventil_house.js", 
      "./db/ventil_reservation.js",
      "./db/ventil_schedule.js",
      "./db/ventil_setting.js",
      "./db/ventil_fan_status.js",
      "./db/push_message3.js",
      "./db/ventil_admin.js",
      "./db/ceiling_fan.js",
      "./db/ceiling_fan_control_log.js",
      "./db/ceiling_fan_group.js",
      "./db/ceiling_fan_group_mapping.js",
      "./db/ceiling_house.js",
      "./db/ceiling_reservation.js",
      "./db/ceiling_reschedule.js",
      "./db/energy_status.js",
      "./db/notice.js",
    ],
    synchronize: false,
    logging: false,
  });
