import { api } from "@/api/axios.api";

export const DemoService = {
  /** Вернуть демо-данные к исходным (изменения хранятся в браузере) */
  reset: async () => {
    await api.post("/demo/reset");
  },
};
