// =============================================================================
// models/User.ts - Mongoose Schema for Google Authenticated Users
// =============================================================================

import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IUser extends Document {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  role: string;
  org: string;
  lastLoginAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    googleId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: '' },
    picture: { type: String, default: '' },
    role: { type: String, default: 'BMA Officer' },
    org: { type: String, default: 'กรุงเทพมหานคร' },
    lastLoginAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) ?? mongoose.model<IUser>('User', UserSchema);

export default User;
