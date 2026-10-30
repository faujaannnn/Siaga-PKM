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
                            <strong class="d-block font-weight-bold text-14">FORM SARAN DAN ADUAN</strong>
                            Silahkan berikan saran maupun aduan untuk peningkatan layanan. !
                        </h1>
                        <form method="POST" action="method=" action="<?= site_url('Baseweb/AddLaporBencana') ?>" accept-charset="UTF-8" class="kontak-email-form" enctype="multipart/form-data">
                            <div class="form-group row">
                                <label for="provinsi" class="col-sm-2 col-form-label">Pilih Saran atau Aduan <span class="text-danger">*</span></label>
                                <div class="input-group bg-light border col-sm-3">
                                    <select class="form-control sel-provinsi" name="provinsi" id="provinsi">
                                        <option value="" disabled="" selected="">-- Pilih --</option>
                                        <option value="saran">Saran</option>
                                        <option value="aduan">Aduan</option>
                                    </select>
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
                            <hr>
                            <b style="color: grey; font-size:16px;">Informasi Pelapor/Instansi <span style="color: red">*</span></b>
                            <div class="form-group row mt-3">
                                <label for="nama_pelapor" class="col-sm-2 col-form-label">Nama <span class="text-danger">*</span></label>
                                <div class="input-group bg-light border col-sm-8">
                                    <input type="text" class="form-control" name="nama_pelapor" id="nama_pelapor" value="">
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <div class="form-group row">
                                <label for="telp_pelapor" class="col-sm-2 col-form-label">No Telp <span class="text-danger">*</span></label>
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
                            <b style="color: grey; font-size:16px;">Silahkan Masukkan Saran atau Aduan</b>
                            <div class="form-group row mt-3">
                                <div class="input-group bg-light border col-sm-12">
                                    <textarea class="form-control" name="kondisi_umum" id="kondisi_umum" rows="5"></textarea>
                                    <span style="color:red !important;"></span>
                                </div>
                            </div>
                            <hr>
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