import { Component } from '@angular/core';
import { Title } from "@angular/platform-browser";
import { environment } from "../environments/environment";
import { Hub } from '@aws-amplify/core';
import { AuthService } from "./services/auth.service";
import { Router } from "@angular/router";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  constructor(private titleService: Title, private authService: AuthService, private router: Router) {
    this.titleService.setTitle(environment.NG_APP_NAME as any);
    Hub.listen('auth', (data: any) => {
      const event = data.payload.event as string;
      switch (event) {
        case 'signIn':
          console.log('user signed in');
          this.authService.setCurrentSession();
          this.router.navigate(['/dashboard']).then();
          break;
        case 'signUp':
          console.log('user signed up');
          break;
        case 'signOut':
          console.log('user signed out');
          break;
        case 'signIn_failure':
          console.log('user sign in failed');
          break;
        case 'configured':
          console.log('the Auth module is configured');
          break;
      }
    });
  }
}