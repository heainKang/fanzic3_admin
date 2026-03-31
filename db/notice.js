import { EntitySchema } from "typeorm";

export default new EntitySchema({
  name: "Notice",
  tableName: "notice",
  columns: {
    id: {
      type: "int",
      primary: true,
      generated: true,
    },
    user_id: {
      type: "varchar",
      length: 30,
      nullable: false, // 필수
    },
    title: {
      type: "varchar",
      length: 45,
      nullable: false, // 필수
    },
    content: {
      type: "mediumtext",
      nullable: true,
    },
    created_at: {
      type: "datetime",
      default: () => "CURRENT_TIMESTAMP",
    },
    updated_at: {
      type: "datetime",
      nullable: true,
      onUpdate: "CURRENT_TIMESTAMP",
    },
  },
});
