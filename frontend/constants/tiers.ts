import { SubscriptionTier } from './types';

export const TIER_INFO: Record<SubscriptionTier, {
  name: string;
  price: string;
  paymentDays: string;
  posts: string;
  applications: string;
  features: string[];
  popular?: boolean;
}> = {
  bronze: {
    name: 'Bronze',
    price: '£29',
    paymentDays: '30 days',
    posts: '2 per month',
    applications: '10 per month',
    features: ['Basic invoice tools', 'Standard reporting', 'Email support'],
  },
  silver: {
    name: 'Silver',
    price: '£59',
    paymentDays: '14 days',
    posts: 'Up to 5 per month',
    applications: '30 per month',
    popular: true,
    features: ['Invoice tools', 'Analytics dashboard', 'Priority support'],
  },
  gold: {
    name: 'Gold',
    price: '£129',
    paymentDays: '7 days',
    posts: 'Unlimited',
    applications: 'Unlimited',
    features: ['Advanced invoicing', 'Discounted insurance', 'Compliance tracking', 'Dedicated support'],
  },
};
