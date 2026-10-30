<div class="content-wrapper">
    <section class="content-header">
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-12">
                    <div class="card card-info">
                        <div class="card-header">
                            <h3 class="card-title">TAMBAH BANNER UTAMA</h3>
                        </div>
                        <div class="card-body">
                            <form action="<?= site_url('Administrator/AddBannerUtama') ?>" method="post" enctype="multipart/form-data">
                                <table class="table table-stripped">
                                    <tr>
                                        <td width="150px">Judul Banner</td>
                                        <td><input type="text" name="judul_banner" class="form-control"></td>
                                    </tr>

                                    <tr>
                                        <td>Gambar Banner</td>
                                        <td>
                                            <input type="file" name="foto_banner" class="form-control">
                                        </td>
                                    </tr>

                                    <tr>
                                        <td colspan="2">
                                            <button class="btn btn-danger"><i class="fas fa-retry"></i> Simpan Banner</button>
                                            <a href="<?= site_url('Administrator/banner_utama') ?>" class="btn btn-primary" id="tblback"><i class="fas fa-reply"></i> Kembali</a>
                                        </td>
                                    </tr>
                                </table>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</div>