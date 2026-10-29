import { Module } from '@nestjs/common';
import { AdminReviewsController, ReviewsController } from './reviews.controller.js';

/** Ratings and reviews (RF-01, RF-02). */
@Module({ controllers: [ReviewsController, AdminReviewsController] })
export class ReviewsModule {}
