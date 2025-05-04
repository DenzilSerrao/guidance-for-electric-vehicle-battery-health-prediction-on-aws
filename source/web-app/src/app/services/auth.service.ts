import { Injectable } from "@angular/core";
import Auth from '@aws-amplify/auth';
import { Router } from "@angular/router";

@Injectable({
  providedIn: "root",
})
export class AuthService {
  isLoggedIn = false;
  currentSession: any;

  constructor(private router: Router) {}

  // Fetch the authentication session
  async fetchSessionStatus() {
    try {
      const session = await Auth.fetchAuthSession();  // Fetch the session using fetchAuthSession

      // Check if session has valid tokens (idToken or accessToken)
      this.isLoggedIn = session? true : false;
      
      return this.isLoggedIn;
    } catch (error) {
      console.error("Error fetching session", error);
      this.isLoggedIn = false;
      return false;
    }
  }

  // Log the user out
  logout() {
    Auth.signOut().then(() => {
      this.router.navigate(["/login"]).then();
    });
  }

  // Get token from current session
  getToken() {
    return this.currentSession?.idToken?.jwtToken;
  }

  // Set the current session using fetchAuthSession
  async setCurrentSession() {
    try {
      const session = await Auth.fetchAuthSession();  // Fetch session
      this.isLoggedIn = true;
      this.currentSession = session;
      console.log("Successfully set the session");
    } catch (error) {
      this.isLoggedIn = false;
      console.log("User needs to log in");
    }
  }
}
