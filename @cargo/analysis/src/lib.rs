mod utils;

use realfft::RealFftPlanner;
use serde::{Deserialize, Serialize};
use core::f32;
use std::cmp;
use wasm_bindgen::prelude::*;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

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

#[wasm_bindgen]
pub struct Analysis {
    planner: RealFftPlanner<f32>,
}

pub fn hann_window(samples: &[f32]) -> Vec<f32> {
    let mut windowed_samples = Vec::with_capacity(samples.len());
    let samples_len_f32 = samples.len() as f32;
    for (i, sample) in samples.iter().enumerate() {
        let two_pi_i = 2.0 * f32::consts::PI * i as f32;
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
        let window = hann_window(input);

        let r2c = self.planner.plan_fft_forward(window.len());

        let mut indata = window.to_vec();
        let mut spectrum = r2c.make_output_vec();
        r2c.process(&mut indata, &mut spectrum).unwrap();

        let nc = 2.0 / (sample_freq as f32 * 1000.0 * window.len() as f32);
        let mut res = FFTResult {
            min: f32::INFINITY,
            max: 0.0,
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

        return serde_wasm_bindgen::to_value(&res).unwrap();
    }

    pub fn decimate(&self, mut width: usize, input: &[f32]) -> Box<[f32]> {
        let mut res = vec![0.0; width];

        if input.len() < width {
            width = input.len();
        }

        let entries_per_pixel = cmp::max(input.len() / width, 1);
        for i in 0..width {
            let mut val = 0.0 as f32;
            for j in 0..entries_per_pixel {
                val += input[i * entries_per_pixel + j]
            }
            res[i] = val / entries_per_pixel as f32;
        }

        return res.into_boxed_slice();
    }

    pub fn moving_avg(&self, window: usize, input: &[f32]) -> Box<[f32]> {
        let mut results: Vec<f32> = Vec::with_capacity(input.len());

        let mut sum = 0.0 as f32;
        for i in 0..window {
            sum += input[i];
        }
        results.push(sum / window as f32);

        let steps = input.len() - window - 1;
        for i in 0..steps {
            sum -= input[i];
            sum += input[i + window];
            results.push(sum / window as f32);
        }

        return results.into_boxed_slice();
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

        return serde_wasm_bindgen::to_value(&res).unwrap();
    }
}
