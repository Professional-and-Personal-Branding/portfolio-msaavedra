export interface AdminOutput {
  id: string;
  email: string;
  name: string;
}

export interface LoginOutput {
  accessToken: string;
  tokenType: 'Bearer';
  /** Segundos hasta la expiración. */
  expiresIn: number;
  user: AdminOutput;
}
