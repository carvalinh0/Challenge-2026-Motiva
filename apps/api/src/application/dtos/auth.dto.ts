import { z } from "zod";

export const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
});
export type LoginDTO = z.infer<typeof loginSchema>;

export interface LoginResultDTO {
    token: string;
    /** Epoch em segundos, igual ao `exp` do JWT. */
    expiresAt: number;
    username: string;
}
