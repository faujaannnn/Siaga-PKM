<div class="content-wrapper">
    <section class="content-header">
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-12">
                    <div class="card card-info">
                        <div class="card-header">
                            <h3 class="card-title">UBAH BANNER UTAMA</h3>
                        </div>
                        <div class="card-body">
                            <form action="<?= site_url('Administrator/Rubah_banner') ?>" method="post" enctype="multipart/form-data">
                                <table class="table table-stripped">
                                    <tr>
                                        <td width="150px">Judul Banner</td>
                                        <td><input type="text" name="judul_banner" class="form-control" value="<?= $banner['judul_banner'] ?>"></td>
                                    </tr>
                                    <tr>
                                        <td>File Photo</td>
                                        <td>
                                            <img src="<?= base_url() ?>assets/img/banner/<?= $banner['foto'] ?>" width="100%" alt=""><br>
                                            <input type="file" name="foto" class="form-control">
                                        </td>
                                    </tr>

                                    <tr>
                                        <td colspan="2">
                                            <input type="hidden" name="id" value="<?= $banner['id_banner'] ?>">
                                            <button type="submit" class="btn btn-info"><i class="fas fa-save"></i> Simpan</button>
                                            <a href="<?= site_url('Administrator/banner_utama') ?>" class="btn btn-danger" id="tblback"><i class="fas fa-reply"></i> Kembali</a>
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