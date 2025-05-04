import { Injectable } from "@angular/core";
import { CanActivate, Router, UrlTree } from "@angular/router";
import { Observable } from "rxjs";
import { AuthService } from "../services/auth.service";
import { fetchAuthSession } from 'aws-amplify/auth';

@Injectable({
  providedIn: "root",
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  async canActivate(): Promise<boolean | UrlTree> {
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      if (idToken) {
        this.authService.isLoggedIn = true;
        return true;
      } else {
        this.router.navigate(["/login"]);
        return false;
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      this.router.navigate(["/login"]);
      return false;
    }
  }
}
