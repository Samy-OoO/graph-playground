import { useContext } from "react";
import { AuthContext, type AuthContextValue } from './authContext';

export function useAuth(): AuthContextValue {
    return useContext(AuthContext);
}