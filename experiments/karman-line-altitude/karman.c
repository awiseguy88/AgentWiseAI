/*
 * Kármán Line Altitude — C prototype (standard library only).
 * Computes Kármán altitude using NASA Glenn "Earth Atmosphere Model - Metric Units".
 * All results are calculated.
 *
 * Build: gcc -O2 -lm -o karman experiments/karman-line-altitude/karman.c
 * Run:   ./karman
 */

#include <math.h>
#include <stdio.h>

#define GM 3.986e14
#define RE 6378000.0
#define R_GAS 0.2869 /* kJ/(kg*K) with pressure in kPa */

double density(double h) {
    double T, p;
    if (h < 11000.0) {
        T = 15.04 - 0.00649 * h;
        p = 101.29 * pow((T + 273.1) / 288.08, 5.256);
    } else if (h < 25000.0) {
        T = -56.46;
        p = 22.65 * exp(1.73 - 0.000157 * h);
    } else {
        T = -131.21 + 0.00299 * h;
        p = 2.488 * pow((T + 273.1) / 216.6, -11.388);
    }
    return p / (R_GAS * (T + 273.1));
}

double orbital_speed(double h) { return sqrt(GM / (RE + h)); }

double karman_altitude(double ws, double cl) {
    double target = 2.0 * ws / cl;
    double lo = 0.0, hi = 120000.0;
    double flo = density(lo) * orbital_speed(lo) * orbital_speed(lo) - target;
    double fhi = density(hi) * orbital_speed(hi) * orbital_speed(hi) - target;
    if (flo <= 0.0 || fhi >= 0.0) return -1.0;
    for (int k = 0; k < 80; k++) {
        double mid = 0.5 * (lo + hi);
        double fm = density(mid) * orbital_speed(mid) * orbital_speed(mid) - target;
        if (fm > 0.0) lo = mid; else hi = mid;
    }
    return 0.5 * (lo + hi);
}

int main(void) {
    double rho0 = density(0.0);
    printf("rho(0) = %.6f kg/m^3 (expected 1.225)\n", rho0);
    double h = karman_altitude(2500.0, 1.0);
    printf("Karman altitude for W/S=2500 N/m^2, C_L=1.0: %.3f km\n", h / 1000.0);
    double ws_vals[] = {250, 500, 750, 1000, 1500, 2000, 2500};
    double cl_vals[] = {0.5, 1.0, 1.5, 2.0};
    printf("\nwing_loading_N_m2,lift_coefficient,ratio_WS_over_CL,karman_altitude_km\n");
    for (int i = 0; i < 7; i++) {
        for (int j = 0; j < 4; j++) {
            double hk = karman_altitude(ws_vals[i], cl_vals[j]) / 1000.0;
            printf("%.1f,%.1f,%.3f,%.6f\n", ws_vals[i], cl_vals[j], ws_vals[i]/cl_vals[j], hk);
        }
    }
    return 0;
}
