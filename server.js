import "reflect-metadata";
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
//import { createServer } from 'http';
import dotenv from "dotenv";
dotenv.config({ path: ".env.fanzic2" }); // 반드시 명시


// DB typeORM
import { AppDataSource3 } from "./db/data-source3.js";

import adminRoutes from './router/adminRouter.js';


// console-stamp
import consoleStamp from 'console-stamp'; // console.log 시간 정보 추가
consoleStamp(console, ['yyyy/mm/dd HH:MM:ss.l']);

const app = express();
const PORT = process.env.SERVER_PORT;

app.use(express.json());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());


// ===== DB 연결 후 서버 시작 =====
// 새 DB 연결
AppDataSource3.initialize()
  .then(() => {
    console.log("✅ 팬직3(Fanzic) DB 연결 완료");
    app.listen(PORT, () => {
      console.log(`🚀 서버 실행 중 PORT: ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ 팬직3 DB 연결 실패:", err);
  });


// ===== 요청 로그 =====
app.use((req, res, next) => {
  console.log(`** 요청 URL ====> ${req.method} ${req.originalUrl}`);
  next();
});


// Router
/*
app.use('/api/users', userRoutes);
app.use('/api/house', houseRoutes);
app.use('/api/fan', fanRoutes);
app.use('/api/fanGroup', fanGroupRoutes);
app.use('/api/fanControl', fanControlRoutes);
app.use('/api/setting', settingRoutes);
app.use('/api/reservation', reservationRoutes);
*/
app.use('/api/admin', adminRoutes);

