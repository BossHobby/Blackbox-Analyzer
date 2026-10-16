mod utils;

use realfft::RealFftPlanner;
use realfft::num_complex::Complex;
use serde::{Deserialize, Serialize};
use std::cmp;
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize)]
pub struct FFTResult {
    pub min: f32,
    pub max: f32,
    pub range: f32,
    pub power: Box<[f32]>,
}

#[derive(Serialize, Deserialize)]
pub struct TransformResult {
    pub range: f32,
    pub values: Box<[f32]>,
}

#[derive(Serialize, Deserialize)]
pub struct StepResult {
    pub windows: usize,
    pub candidates: usize,
    pub mean: Vec<f32>,
    pub low: Vec<f32>,
    pub high: Vec<f32>,
}

// Step response estimation: setpoint -> gyro is treated as a linear system
// and its impulse response is recovered by regularized deconvolution of the
// cross spectra summed over 1 s windows.
const STEP_FRAME_S: f32 = 1.0;
const STEP_RESPONSE_S: f32 = 0.5;
// Regularization is negligible in the control band and becomes a smooth wall
// above it, so gyro noise does not dominate. A lower cutoff biased the steady
// state low on real logs (yaw to ~0.65 at 40 Hz).
const STEP_SNR: f32 = 1e6;
const STEP_NOISE_CUTOFF_HZ: f32 = 100.0;
const STEP_NOISE_WIDTH_HZ: f32 = 5.0;
const STEP_NOISE_STOP: f32 = 10.0;
// Windows are spread over this many groups to estimate the spread.
const STEP_GROUPS: usize = 8;
// Windows whose gyro departs from setpoint by more than the setpoint itself
// (crashes, hard hits) are left out.
const STEP_MAX_ERROR_RATIO: f32 = 1.0;

fn step_regularization(f: f32) -> f32 {
    let stop = 1.0 / (1.0 + (-(f - STEP_NOISE_CUTOFF_HZ) / STEP_NOISE_WIDTH_HZ).exp());
    1.0 / STEP_SNR + STEP_NOISE_STOP * stop
}

fn quantile(sorted: &[f32], q: f32) -> f32 {
    let pos = q * (sorted.len() - 1) as f32;
    let lo = pos.floor() as usize;
    let hi = pos.ceil() as usize;
    sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo as f32)
}

/// `closed_loop` marks frames where the controller tracks setpoint (empty:
/// all of them); windows touching any open-loop frame are skipped.
pub fn step_response(
    planner: &mut RealFftPlanner<f32>,
    sample_freq: f32,
    min_input: f32,
    input: &[f32],
    output: &[f32],
    closed_loop: &[u8],
) -> StepResult {
    let frame_len = (sample_freq * STEP_FRAME_S) as usize;
    let response_len = (sample_freq * STEP_RESPONSE_S) as usize;
    let mut result = StepResult {
        windows: 0,
        candidates: 0,
        mean: vec![],
        low: vec![],
        high: vec![],
    };
    let len = input.len().min(output.len());
    if frame_len < 16 || len < frame_len {
        return result;
    }

    // Zero padding to twice the frame keeps the circular deconvolution
    // from wrapping the response back onto its start.
    let fft_len = frame_len * 2;
    let r2c = planner.plan_fft_forward(fft_len);
    let c2r = planner.plan_fft_inverse(fft_len);
    let window = hann_window(&vec![1.0; frame_len]);
    let hz_per_bin = sample_freq / fft_len as f32;

    let mut x = r2c.make_input_vec();
    let mut y = r2c.make_input_vec();
    let mut sx = r2c.make_output_vec();
    let mut sy = r2c.make_output_vec();
    let bins = sx.len();

    // H1 estimator: cross and input spectra are summed over windows before
    // dividing. Most gyro motion is not caused by the stick, so per-window
    // estimates are noisy and their average is biased. Interleaved groups of
    // windows give the spread shown around the mean.
    let mut groups = vec![Spectra::new(bins); STEP_GROUPS];
    let hop = frame_len / 2;
    let mut start = 0;
    while start + frame_len <= len {
        let sp = &input[start..start + frame_len];
        let gy = &output[start..start + frame_len];
        let open_loop = !closed_loop.is_empty()
            && closed_loop[start..(start + frame_len).min(closed_loop.len())].contains(&0);
        start += hop;
        result.candidates += 1;

        if open_loop || !sp.iter().any(|v| v.abs() >= min_input) {
            continue;
        }
        // Crashes and hard hits move the gyro far more than the stick asked
        // for; such windows describe the impact, not the controller.
        let input_power: f32 = sp.iter().map(|v| v * v).sum();
        let error_power: f32 = sp.iter().zip(gy).map(|(s, g)| (g - s) * (g - s)).sum();
        if error_power > STEP_MAX_ERROR_RATIO * input_power {
            continue;
        }

        for i in 0..frame_len {
            x[i] = sp[i] * window[i];
            y[i] = gy[i] * window[i];
        }
        x[frame_len..].fill(0.0);
        y[frame_len..].fill(0.0);
        r2c.process(&mut x, &mut sx).unwrap();
        r2c.process(&mut y, &mut sy).unwrap();
        groups[result.windows % STEP_GROUPS].add(&sx, &sy);
        result.windows += 1;
    }

    if result.windows == 0 {
        return result;
    }

    let mut to_step = |spectra: &Spectra| {
        let mean_power = spectra.xx.iter().sum::<f64>() / bins as f64;
        let mut h = c2r.make_input_vec();
        for (k, value) in h.iter_mut().enumerate() {
            let f = k as f32 * hz_per_bin;
            let noise = mean_power * step_regularization(f) as f64;
            let denom = spectra.xx[k] + noise;
            value.re = (spectra.xy_re[k] / denom) as f32;
            value.im = (spectra.xy_im[k] / denom) as f32;
        }
        // A real signal's DC and Nyquist bins are purely real.
        h[0].im = 0.0;
        h[bins - 1].im = 0.0;
        let mut impulse = c2r.make_output_vec();
        c2r.process(&mut h, &mut impulse).unwrap();

        let mut acc = 0.0;
        impulse
            .iter()
            .take(response_len)
            .map(|value| {
                acc += value / fft_len as f32;
                acc
            })
            .collect::<Vec<f32>>()
    };

    let mut total = Spectra::new(bins);
    for group in groups.iter() {
        total.merge(group);
    }
    result.mean = to_step(&total);

    let group_steps: Vec<Vec<f32>> = groups
        .iter()
        .filter(|group| group.windows > 0)
        .map(&mut to_step)
        .collect();
    let mut column = vec![0.0f32; group_steps.len()];
    for t in 0..response_len {
        for (i, step) in group_steps.iter().enumerate() {
            column[i] = step[t];
        }
        column.sort_by(|a, b| a.partial_cmp(b).unwrap_or(cmp::Ordering::Equal));
        result.low.push(quantile(&column, 0.25));
        result.high.push(quantile(&column, 0.75));
    }

    result
}

#[derive(Clone)]
struct Spectra {
    windows: usize,
    xx: Vec<f64>,
    xy_re: Vec<f64>,
    xy_im: Vec<f64>,
}

impl Spectra {
    fn new(bins: usize) -> Spectra {
        Spectra {
            windows: 0,
            xx: vec![0.0; bins],
            xy_re: vec![0.0; bins],
            xy_im: vec![0.0; bins],
        }
    }

    fn add(&mut self, x: &[Complex<f32>], y: &[Complex<f32>]) {
        self.windows += 1;
        for k in 0..x.len() {
            let xy = y[k] * x[k].conj();
            self.xx[k] += x[k].norm_sqr() as f64;
            self.xy_re[k] += xy.re as f64;
            self.xy_im[k] += xy.im as f64;
        }
    }

    fn merge(&mut self, other: &Spectra) {
        self.windows += other.windows;
        for k in 0..self.xx.len() {
            self.xx[k] += other.xx[k];
            self.xy_re[k] += other.xy_re[k];
            self.xy_im[k] += other.xy_im[k];
        }
    }
}

#[wasm_bindgen]
pub struct Analysis {
    planner: RealFftPlanner<f32>,
}

pub fn hann_window(samples: &[f32]) -> Vec<f32> {
    let mut windowed_samples = Vec::with_capacity(samples.len());
    if samples.is_empty() {
        return windowed_samples;
    }

    let samples_len_f32 = samples.len() as f32;
    for (i, sample) in samples.iter().enumerate() {
        let two_pi_i = 2.0 * std::f32::consts::PI * i as f32;
        let idontknowthename = f32::cos(two_pi_i / samples_len_f32);
        let multiplier = 0.5 * (1.0 - idontknowthename);
        windowed_samples.push(multiplier * sample)
    }
    windowed_samples
}

#[wasm_bindgen]
impl Analysis {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Analysis {
        utils::set_panic_hook();

        Analysis {
            planner: RealFftPlanner::<f32>::new(),
        }
    }

    pub fn fft(&mut self, sample_freq: i32, input: &[f32]) -> JsValue {
        if input.len() < 2 || sample_freq <= 0 {
            let res = FFTResult {
                min: 0.0,
                max: 0.0,
                range: 0.0,
                power: vec![].into_boxed_slice(),
            };
            return serde_wasm_bindgen::to_value(&res).unwrap();
        }

        let window = hann_window(input);

        let r2c = self.planner.plan_fft_forward(window.len());

        let mut indata = window.to_vec();
        let mut spectrum = r2c.make_output_vec();
        r2c.process(&mut indata, &mut spectrum).unwrap();

        let nc = 2.0 / (sample_freq as f32 * window.len() as f32);
        let mut res = FFTResult {
            min: f32::INFINITY,
            max: f32::NEG_INFINITY,
            range: 0.0,
            power: vec![0.0; spectrum.len()].into_boxed_slice(),
        };
        for i in 0..spectrum.len() {
            let real = spectrum[i].norm();

            let mut val = f32::powf(f32::abs(real), 2.0) * nc;
            if val != 0.0 {
                val = 10.0 * f32::log10(val);
            }

            res.power[i] = val;
            res.min = f32::min(res.min, val);
            res.max = f32::max(res.max, val);
            res.range = f32::max(res.range, f32::abs(val));
        }

        serde_wasm_bindgen::to_value(&res).unwrap()
    }

    /// Windowed power spectral density, one column of `fft_len / 2 + 1` bins
    /// per hop, in linear units. Each window has its mean removed.
    pub fn spectrogram(
        &mut self,
        sample_freq: f32,
        fft_len: usize,
        hop: usize,
        input: &[f32],
    ) -> Box<[f32]> {
        if fft_len < 2 || hop == 0 || input.len() < fft_len || sample_freq <= 0.0 {
            return vec![].into_boxed_slice();
        }

        let window: Vec<f32> = hann_window(&vec![1.0; fft_len]);
        let window_power: f32 = window.iter().map(|w| w * w).sum();
        let scale = 2.0 / (sample_freq * window_power);

        let r2c = self.planner.plan_fft_forward(fft_len);
        let mut frame = r2c.make_input_vec();
        let mut spectrum = r2c.make_output_vec();
        let bins = spectrum.len();
        let columns = (input.len() - fft_len) / hop + 1;
        let mut res = vec![0.0f32; columns * bins];

        for column in 0..columns {
            let samples = &input[column * hop..column * hop + fft_len];
            let mean = samples.iter().sum::<f32>() / fft_len as f32;
            for i in 0..fft_len {
                frame[i] = (samples[i] - mean) * window[i];
            }
            r2c.process(&mut frame, &mut spectrum).unwrap();
            for (bin, value) in spectrum.iter().enumerate() {
                res[column * bins + bin] = value.norm_sqr() * scale;
            }
        }

        res.into_boxed_slice()
    }

    /// Averaged step response of `output` (gyro) to `input` (setpoint) over
    /// the first 500 ms. Windows whose setpoint never exceeds `min_input` carry
    /// no information and are skipped, as are windows with open-loop frames.
    pub fn step_response(
        &mut self,
        sample_freq: f32,
        min_input: f32,
        input: &[f32],
        output: &[f32],
        closed_loop: &[u8],
    ) -> JsValue {
        let result = step_response(
            &mut self.planner,
            sample_freq,
            min_input,
            input,
            output,
            closed_loop,
        );
        serde_wasm_bindgen::to_value(&result).unwrap()
    }

    pub fn decimate(&self, mut width: usize, input: &[f32]) -> Box<[f32]> {
        if input.is_empty() || width == 0 {
            return vec![].into_boxed_slice();
        }

        let mut res = vec![0.0; width];

        if input.len() < width {
            width = input.len();
            res = vec![0.0; width];
        }

        let entries_per_pixel = cmp::max(input.len() / width, 1);
        for i in 0..width {
            let mut val = 0.0_f32;
            for j in 0..entries_per_pixel {
                val += input[i * entries_per_pixel + j]
            }
            res[i] = val / entries_per_pixel as f32;
        }

        res.into_boxed_slice()
    }

    pub fn moving_avg(&self, window: usize, input: &[f32]) -> Box<[f32]> {
        if input.is_empty() || window == 0 || window > input.len() {
            return input.to_vec().into_boxed_slice();
        }

        let mut results: Vec<f32> = Vec::with_capacity(input.len());

        let mut sum = 0.0_f32;
        for i in 0..window {
            sum += input[i];
        }
        results.push(sum / window as f32);

        let steps = input.len() - window;
        for i in 0..steps {
            sum -= input[i];
            sum += input[i + window];
            results.push(sum / window as f32);
        }

        results.into_boxed_slice()
    }

    pub fn transform(&self, expo: f32, window: usize, input: &[f32]) -> JsValue {
        let mut res = TransformResult {
            range: 0.0,
            values: vec![0.0; input.len()].into_boxed_slice(),
        };

        for i in 0..input.len() {
            let mut val = input[i];
            val = f32::powf(f32::abs(val), expo) * f32::signum(val);
            res.range = f32::max(res.range, f32::abs(val));
            res.values[i] = val;
        }

        res.values = self.moving_avg(window, &res.values);

        serde_wasm_bindgen::to_value(&res).unwrap()
    }
}

impl Default for Analysis {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // A first-order lag with transport delay: gyro follows setpoint with time
    // constant TAU after DELAY. Its true step response is known exactly.
    #[test]
    fn step_response_recovers_first_order_lag() {
        const FS: f32 = 1000.0;
        const TAU: f32 = 0.015;
        const DELAY: usize = 5;
        let n = 60_000;

        // Stick-like input: random holds between 50 and 400 ms, smoothed.
        let mut seed: u32 = 12345;
        let mut rand = || {
            seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
            (seed >> 8) as f32 / (1u32 << 24) as f32
        };
        let mut setpoint = vec![0.0f32; n];
        let mut i = 0;
        while i < n {
            let hold = 50 + (rand() * 350.0) as usize;
            let level = (rand() - 0.5) * 1000.0;
            for v in setpoint.iter_mut().skip(i).take(hold) {
                *v = level;
            }
            i += hold;
        }

        let alpha = 1.0 - (-1.0 / (FS * TAU)).exp();
        let mut gyro = vec![0.0f32; n];
        let mut state = 0.0;
        for i in 0..n {
            let target = if i >= DELAY { setpoint[i - DELAY] } else { 0.0 };
            state += alpha * (target - state);
            gyro[i] = state + (rand() - 0.5) * 20.0;
        }

        let mut planner = RealFftPlanner::<f32>::new();
        let result = step_response(&mut planner, FS, 20.0, &setpoint, &gyro, &[]);
        assert!(result.windows > 50, "windows {}", result.windows);

        let expected = |t: usize| {
            if t < DELAY {
                0.0
            } else {
                1.0 - (-((t - DELAY) as f32) / (FS * TAU)).exp()
            }
        };
        for t in [10, 20, 40, 100, 300] {
            let got = result.mean[t];
            assert!(
                (got - expected(t)).abs() < 0.1,
                "t={}ms got {} expected {}",
                t,
                got,
                expected(t)
            );
        }
    }
}
