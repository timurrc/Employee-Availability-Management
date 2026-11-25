import type { Role } from "./employee.types";

export interface IUser {
  /** id сотрудника — пользователь и сотрудник одно и то же */
  id: string;
  name: string;
  position: string;
  role: Role;
}

/** Демо-вход: выбор учётной записи вместо логина и пароля */
export interface ILoginDto {
  employeeId: string;
}

export interface IAuthResponse {
  accessToken: string;
  user: IUser;
}
