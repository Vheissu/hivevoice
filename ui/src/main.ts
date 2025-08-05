import Aurelia from 'aurelia';
import { RouterConfiguration } from '@aurelia/router';
import { ValidationConfiguration } from '@aurelia/validation';
import { HttpClientConfiguration } from '@aurelia/fetch-client';
import { MyApp } from './my-app';
import { IApiService } from './services/api';
import { IAuthService } from './services/auth';
import { IInvoiceService } from './services/invoice';
import { IPaymentService } from './services/payment';

Aurelia
  .register(
    RouterConfiguration.customize({
      useUrlFragmentHash: false,
    }),
    ValidationConfiguration,
    HttpClientConfiguration,
    IApiService,
    IAuthService,
    IInvoiceService,
    IPaymentService
  )
  .app(MyApp)
  .start();
