<div role="main" class="main">
    <!-- preloader section start -->
    <div class="loader-container">
        <span class="loader">
            <span class="loader-inner"></span>
        </span>
    </div>
    <section class="section section-height-3">
        <div class="container">
            <div class="row">
                <div class="col-md-12">
                    <div class="header-search-expanded">
                        <h1 class="font-weight-bold text-6 mb-5 appear-animation animated fadeInUpShorter appear-animation-visible" data-appear-animation="fadeInUpShorter" data-appear-animation-delay="200" style="animation-delay: 200ms;">
                            <strong class="d-block font-weight-bold text-14">LAPOR BENCANA</strong>
                            Silahkan Lapor Bencana Disekitar Anda !
                        </h1>
                        <form method="POST" action="method=" action="<?= site_url('Baseweb/AddLaporBencana') ?>" accept-charset="UTF-8" class="kontak-email-form" enctype="multipart/form-data">
                            <b style="color: grey; font-size:16px;">Kejadian Bencana <span style="color: red">*</span></b>
                            <div class="form-group row">
                                <label for="jenis_bencana" class="col-sm-2 col-form-label">Jenis Bencana <span class="text-danger">*</span></label>
                                <div class="input-group bg-light border col-sm-8">
                                    <input type="text" class="form-control" name="jenis_bencana" id="jenis_bencana" placeholder="Jenis Bencana" value="">
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <div class="form-group row">
                                <label for="tgl_kejadian" class="col-sm-2 col-form-label">Tanggal Kejadian <span class="text-danger">*</span></label>
                                <div class="input-group bg-light border col-sm-3">
                                    <input type="date" class="form-control" name="tgl_kejadian" id="tgl_kejadian" value="">
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <div class="form-group row">
                                <label for="waktu_kejadian" class="col-sm-2 col-form-label">Waktu Kejadian <span class="text-danger">*</span></label>
                                <div class="input-group bg-light border col-sm-2">
                                    <input type="time" class="form-control" name="waktu_kejadian" id="waktu_kejadian" value="">
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <div class="form-group row">
                                <label for="provinsi" class="col-sm-2 col-form-label">Provinsi <span class="text-danger">*</span></label>
                                <div class="input-group bg-light border col-sm-4">
                                    <select class="form-control sel-provinsi" name="kode_provinsi" id="provinsi">
                                        <option value="" disabled="" selected="">-- Pilih Provinsi--</option>
                                        <option value="72">SULAWESI TENGAH</option>
                                    </select>
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <div class="form-group row">
                                <label for="kabupaten" class="col-sm-2 col-form-label">Kabupaten/Kota <span class="text-danger">*</span></label>
                                <div class="input-group bg-light border col-sm-4">
                                    <select class="form-control sel-kabupaten" name="kode_kabkota" id="kabupaten">
                                        <option value="">-- Pilih Kabupaten/Kota --</option>
                                    </select>
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <div class="form-group row">
                                <label for="kecamatan" class="col-sm-2 col-form-label">Kecamatan <span class="text-danger">*</span></label>
                                <div class="input-group bg-light border col-sm-4">
                                    <select class="form-control sel-kecamatan" name="kode_kecamatan" id="kecamatan">
                                        <option value="">-- Pilih Kecamatan --</option>
                                    </select>
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <div class="form-group row">
                                <label for="kelurahan" class="col-sm-2 col-form-label">Kelurahan/Desa <span class="text-danger">*</span></label>
                                <div class="input-group bg-light border col-sm-4">
                                    <select class="form-control sel-kelurahan" name="id_kelurahan" id="kelurahan">
                                        <option value="">-- Pilih Desa/Kelurahan --</option>
                                    </select>
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <div class="form-group row">
                                <label for="lokasi_kejadian" class="col-sm-2 col-form-label">Lokasi Kejadian <span class="text-danger">*</span>
                                    <p style="color: red; font-size:10px;">Klik peta untuk isi lokasi</p>
                                </label>
                                <div class="input-group bg-light border col-sm-10">
                                    <div class="input-group mb-2">
                                        <input type="text" id="lokasi_kejadian" name="lokasi_kejadian" class="form-control" placeholder="" aria-label="lokasi_kejadian" aria-describedby="button-lokasi_kejadian">
                                    </div>
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <div class="form-group row">
                                <div class="col-sm-12">
                                    <div class="row">
                                        <label for="lokasi_kejadian" class="col-sm-2 col-form-label">Koordinat Lokasi<span class="text-danger">*</span>
                                            <p style="color: red; font-size:10px;">Klik peta untuk isi koordinat lokasi</p>
                                        </label>
                                        <div class="input-group bg-light border col-sm-5">
                                            <input type="text" id="map-lat" class="form-control" name="lat" placeholder="Latitude">
                                            <span style="color:red !important;"></span>
                                        </div>
                                        <div class="input-group bg-light border col-sm-5">
                                            <input type="text" id="map-lng" class="form-control" name="lng" placeholder="Longitude">
                                            <span style="color:red !important;"></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="form-group row">
                                <label for="penyebab_bencana" class="col-sm-2 col-form-label">Penyebab Bencana <span class="text-danger">*</span></label>
                                <div class="input-group bg-light border col-sm-10">
                                    <input type="text" class="form-control" name="penyebab_bencana" id="penyebab_bencana" value="">
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <hr>
                            <b style="color: grey; font-size:16px;">Dampak Bencana</b>
                            <div class="form-group row mt-3">
                                <label for="dampak_bencana_rr" class="col-sm-2 col-form-label">Rusak Ringan (RR)</label>
                                <div class="input-group bg-light border col-sm-2">
                                    <input type="number" class="form-control" name="dampak_bencana_rr" id="dampak_bencana_rr" value="">
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <div class="form-group row">
                                <label for="dampak_bencana_rs" class="col-sm-2 col-form-label">Rusak Sedang (RS)</label>
                                <div class="input-group bg-light border col-sm-2">
                                    <input type="number" class="form-control" name="dampak_bencana_rs" id="dampak_bencana_rs" value="">
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <div class="form-group row">
                                <label for="dampak_bencana_rb" class="col-sm-2 col-form-label">Rusak Berat (RB)</label>
                                <div class="input-group bg-light border col-sm-2">
                                    <input type="number" class="form-control" name="dampak_bencana_rb" id="dampak_bencana_rb" value="">
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <hr>
                            <b style="color: grey; font-size:16px;">Korban Jiwa</b>
                            <div class="form-group row mt-3">
                                <label for="korban_jiwa_md" class="col-sm-2 col-form-label">Meninggal Dunia (MD)</label>
                                <div class="input-group bg-light border col-sm-2">
                                    <input type="number" class="form-control" name="korban_jiwa_md" id="korban_jiwa_md" value="">
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <div class="form-group row">
                                <label for="korban_jiwa_lr" class="col-sm-2 col-form-label">Luka Ringan (LR)</label>
                                <div class="input-group bg-light border col-sm-2">
                                    <input type="number" class="form-control" name="korban_jiwa_lr" id="korban_jiwa_lr" value="">
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <div class="form-group row">
                                <label for="korban_jiwa_lb" class="col-sm-2 col-form-label">Luka Berat (LB)</label>
                                <div class="input-group bg-light border col-sm-2">
                                    <input type="number" class="form-control" name="korban_jiwa_lb" id="korban_jiwa_lb" value="">
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <hr>
                            <b style="color: grey; font-size:16px;">Pengungsi Jiwa/KK</b>
                            <div class="form-group row mt-3">
                                <label for="pengungsi_jiwa" class="col-sm-2 col-form-label">Jiwa</label>
                                <div class="input-group bg-light border col-sm-2">
                                    <input type="number" class="form-control" name="pengungsi_jiwa" id="pengungsi_jiwa" value="">
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <div class="form-group row">
                                <label for="pengungsi_kk" class="col-sm-2 col-form-label">KK</label>
                                <div class="input-group bg-light border col-sm-2">
                                    <input type="number" class="form-control" name="pengungsi_kk" id="pengungsi_kk" value="">
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <hr>
                            <b style="color: grey; font-size:16px;">Informasi Pelapor/Instansi <span style="color: red">*</span></b>
                            <div class="form-group row mt-3">
                                <label for="nama_pelapor" class="col-sm-2 col-form-label">Nama Pelapor <span class="text-danger">*</span></label>
                                <div class="input-group bg-light border col-sm-8">
                                    <input type="text" class="form-control" name="nama_pelapor" id="nama_pelapor" value="">
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <div class="form-group row">
                                <label for="telp_pelapor" class="col-sm-2 col-form-label">No Telp Darurat <span class="text-danger">*</span></label>
                                <div class="input-group bg-light border col-sm-6">
                                    <input type="text" class="form-control" name="telp_pelapor" id="telp_pelapor" value="">
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <div class="form-group row">
                                <label for="email_pelapor" class="col-sm-2 col-form-label">Email <span class="text-danger">*</span></label>
                                <div class="input-group bg-light border col-sm-6">
                                    <input type="email" class="form-control" name="email_pelapor" id="email_pelapor" value="">
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <hr>
                            <div class="form-group row">
                                <label for="image" class="col-sm-2 col-form-label">File Upload Gambar (max:2MB) <span class="text-danger">*</span></label>
                                <div class="input-group bg-light border col-sm-6">
                                    <input type="file" class="form-control" name="image" id="image" value="" accept="image/*">
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <hr>
                            <b style="color: grey; font-size:16px;">Kondisi Umum / Kronologis</b>
                            <div class="form-group row mt-3">
                                <div class="input-group bg-light border col-sm-12">
                                    <textarea class="form-control" name="kondisi_umum" id="kondisi_umum" rows="5"></textarea>
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <hr>
                            <b style="color: grey; font-size:16px;">Kegiatan/Assesment/Upaya Penanganan Darurat yang di lakukan</b>
                            <div class="form-group row mt-3">
                                <div class="input-group bg-light border col-sm-12">
                                    <textarea class="form-control" name="kegiatan" id="kegiatan" rows="5"></textarea>
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <hr>
                            <b style="color: grey; font-size:16px;">Kendala/Kebutuhan mendesask/Potensi Bencana Susulan</b>
                            <div class="form-group row mt-3">
                                <div class="input-group bg-light border col-sm-12">
                                    <textarea class="form-control" name="kendala" id="kendala" rows="5"></textarea>
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <hr>
                            <b style="color: grey; font-size:16px;">Silahkan tekan tombol kirim laporan.!</b>
                            <div class="form-group text-center">
                                <a href="#" class="btn btn-primary mt-4 btn-rounded btn-v-3 btn-h-3 font-weight-bold appear-animation animated fadeInUpShorter appear-animation-visible" data-appear-animation="fadeInUpShorter" data-appear-animation-delay="800" style="animation-delay: 800ms;"> Kirim Laporan</a>
                            </div>

                        </form>
                    </div>
                </div>
            </div>
        </div>
    </section>
</div>