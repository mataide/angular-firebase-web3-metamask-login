import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Auth, signOut, signInWithCustomToken } from '@angular/fire/auth';
import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import detectEthereumProvider from '@metamask/detect-provider';

interface NonceResponse {
  nonce: string;
}

interface VerifyResponse {
  token: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private http: HttpClient, private auth: Auth) {}

  public signOut() {
    return signOut(this.auth);
  }

  public signInWithMetaMask() {
    let ethereum: any;

    return from(detectEthereumProvider()).pipe(
      // Step 1: Request (limited) access to users ethereum account
      switchMap(async (provider) => {
        if (!provider) {
          throw new Error('Please install MetaMask');
        }

        ethereum = provider;

        return await ethereum.request({ method: 'eth_requestAccounts' });
      }),
      // Step 2: Retrieve the current nonce for the requested address
      switchMap(() =>
        this.http.get<NonceResponse>(
          `https://l73zoabqa4.execute-api.us-east-1.amazonaws.com/dev/user/nonce/${ethereum.selectedAddress}`,
          {
            headers: {'x-api-key': 'xxxxxxxxxxxxxxxx'}
          }
        )
      ),
      // Step 3: Get the user to sign the nonce with their private key
      switchMap(
        async (response) =>
          await ethereum.request({
            method: 'personal_sign',
            params: [
              `0x${this.toHex(response.nonce)}`,
              ethereum.selectedAddress,
            ],
          })
      ),
      // Step 4: If the signature is valid, retrieve a custom auth token for Firebase
      switchMap((sig) =>
        this.http.post<VerifyResponse>(
          'https://l73zoabqa4.execute-api.us-east-1.amazonaws.com/dev/user/web3',
          { address: ethereum.selectedAddress, signature: sig },{
            headers: {'x-api-key': 'xxxxxxxxxxxxxxx'}
          }
        )
      ),
      // Step 5: Use the auth token to auth with Firebase
      switchMap(
        async (response) =>
          await signInWithCustomToken(this.auth, response.token)
      )
    );
  }

  private toHex(stringToConvert: string) {
    return stringToConvert
      .split('')
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('');
  }
}
