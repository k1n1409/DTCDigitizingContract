import { create } from "zustand";
import { UserProfileDto } from "@/services/auth-api";
import { purgeReviewRecovery } from "@/lib/review-recovery";
import { clearContractList } from "@/lib/contract-list-return";

interface AuthState {
  user: UserProfileDto | null;
  isAuthenticated: boolean;
  setUser: (userData: UserProfileDto | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,

  setUser: (userData) => {
    const previous = get().user;
    if (previous && (!userData || previous.tenantId !== userData.tenantId || previous.employeeId !== userData.employeeId)) {
      purgeReviewRecovery();
      clearContractList();
    }
    set({
      user: userData,
      isAuthenticated: !!userData,
    });
  },

  logout: () => {
    purgeReviewRecovery();
    clearContractList();
    set({
      user: null,
      isAuthenticated: false,
    });
  },
}));
