export interface LoginFormState {
  status: "idle" | "error";
  fieldErrors?: {
    username?: string;
    password?: string;
  };
  formError?: string;
}

export const initialLoginFormState: LoginFormState = { status: "idle" };
