<div class="content-wrapper">
    <section class="content-header">
        <div class="container-fluid">
            <div class="row">
                <div class="col-xl-7 col-lg-7 col-md-6 col-sm-12">
                    <div class="card">
                        <div class="card-body p-3">
                            <iframe style="width: 100%; height: 609px;" src="<?php echo base_url() ?>assets/plugin_video/materi/<?= $materi['file'] ?>" type="application/pdf"></iframe>
                        </div>
                    </div>
                </div>
                <div class="col-xl-5 col-lg-7 col-md-6 col-sm-12">
                    <div class="row">
                        <div class="col-xl-12 col-lg-7 col-md-6 col-sm-12">
                            <div class="card card-info">
                                <div class="card-header">
                                    <h3 class="card-title">EDIT LITERASI MATERI</h3>
                                </div>
                                <div class="card-body">
                                    <form action="<?= site_url('Administrator/UbahLiterasiMateri') ?>" method="post" enctype="multipart/form-data">
                                        <table class="table table-stripped">
                                            <tr>
                                                <td width="150px">Judul Materi <br>
                                                    <input type="text" name="nama_materi" class="form-control" value="<?= $materi['nama_materi'] ?>">
                                                </td>
                                            </tr>
                                            <tr>
                                                <td width="150px">Deskripsi <br>
                                                    <input type="text" name="deskripsi" class="form-control" value="<?= $materi['deskripsi'] ?>">
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>Ganti Gambar Ikon <br>

                                                    <input type="file" name="file_gambar" class="form-control">
                                                </td>
                                            </tr>

                                            <tr>
                                                <td>
                                                    <input type="hidden" name="id_materi" value="<?= $materi['id_materi'] ?>">
                                                    <button type="submit" class="btn btn-info"><i class="fas fa-save"></i> Ubah</button>
                                                    <a href="<?= site_url('Administrator/literasi_materi') ?>" class="btn btn-danger" id="tblback"><i class="fas fa-reply"></i> Kembali</a>
                                                </td>
                                            </tr>
                                        </table>
                                    </form>
                                </div>
                            </div>
                        </div>
                        <div class="col-xl-12 col-lg-7 col-md-6 col-sm-12">
                            <div class="card card-info">
                                <div class="card-body">
                                    <form action="<?= site_url('Administrator/UbahFileLiterasiMateri') ?>" method="post" enctype="multipart/form-data">
                                        <table class="table table-stripped">

                                            <tr>
                                                <td>Ganti File <br>

                                                    <input type="file" name="file_materi" class="form-control">
                                                </td>
                                            </tr>

                                            <tr>
                                                <td>
                                                    <input type="hidden" name="id_materi" value="<?= $materi['id_materi'] ?>">
                                                    <button type="submit" class="btn btn-info"><i class="fas fa-save"></i> Ubah File</button>
                                                </td>
                                            </tr>
                                        </table>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    </section>
</div>