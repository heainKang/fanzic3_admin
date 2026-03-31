import { EntitySchema } from "typeorm";

export default new EntitySchema({
  name: "PushMessage3",             // TypeORM 내부에서 사용할 Entity 이름
  tableName: "push_message",       // 실제 DB 테이블 이름
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: true,
    },
    messageContent: {
      type: String,
      length: 200,
    },
    sendTime: {
      type: "datetime",
      default: () => "CURRENT_TIMESTAMP",
      nullable: true,
    },
    user_id: {
      type: Number,
    },
  },
  relations: {
    user: {
      type: "many-to-one",
      target: "user",
      joinColumn: { name: "user_id" },
      onDelete: "CASCADE"
    },
  },
});
